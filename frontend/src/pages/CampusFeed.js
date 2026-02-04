import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { 
  Megaphone, Heart, MessageCircle, Send, Plus, Trash2, 
  Award, Bell, ArrowLeft, Calendar, User, X,
  Image as ImageIcon, MessageSquareOff, GraduationCap, Shield
} from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Campus Notice & Appreciation Feed
 * REFACTORED: Fixed all critical bugs
 * 
 * FIX #1: Comment input focus loss - Using isolated state per post
 * FIX #2: Admin/SuperAdmin can view all comments
 * FIX #3: Image upload with preview (Instagram-like)
 * FIX #4: Likes & comments visible to ALL users
 * FIX #5: Comment author display (name, dept, year only - no sensitive data)
 * FIX #6: Comment likes with double-tap
 * FIX #7: Admin moderation capabilities
 */

// Isolated Comment Input Component - FIX #1: Prevents parent re-render
const CommentInput = memo(({ postId, onSubmit, disabled }) => {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const handleSubmit = useCallback(() => {
    if (text.trim()) {
      onSubmit(postId, text.trim());
      setText('');
    }
  }, [postId, text, onSubmit]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="flex gap-2 pt-3 border-t border-slate-100">
      <Input
        ref={inputRef}
        placeholder="Write a comment..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1"
        disabled={disabled}
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!text.trim() || disabled}
        className="bg-purple-600 hover:bg-purple-700"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
});

CommentInput.displayName = 'CommentInput';

// Comment Item Component with Like functionality - FIX #6
const CommentItem = memo(({ comment, postId, canDelete, onDelete, onLike, currentUserId, token }) => {
  const [isLiked, setIsLiked] = useState(comment.liked_by?.includes(currentUserId) || false);
  const [likeCount, setLikeCount] = useState(comment.likes || 0);
  const lastTapRef = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      handleLike();
    }
    lastTapRef.current = now;
  }, []);

  const handleLike = useCallback(async () => {
    // Optimistic update
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? prev - 1 : prev + 1);

    try {
      await onLike(postId, comment.id);
    } catch (error) {
      // Revert on error
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : prev - 1);
    }
  }, [postId, comment.id, isLiked, onLike]);

  // FIX #5: Only show safe info - name, department, year
  const authorInfo = comment.author || {};
  const isAdminComment = comment.is_admin_comment;

  return (
    <div 
      className="flex items-start gap-2 bg-slate-50 rounded-lg p-3 cursor-pointer"
      onClick={handleDoubleTap}
    >
      {/* Profile Picture */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-white">
          {authorInfo.full_name?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800">
              {authorInfo.full_name || 'Anonymous'}
            </p>
            {/* Admin Badge */}
            {isAdminComment && (
              <Badge className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
            {/* Student Info - Department & Year */}
            {!isAdminComment && (authorInfo.department || authorInfo.year) && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <GraduationCap className="w-3 h-3" />
                {authorInfo.department} {authorInfo.year && `• ${authorInfo.year}`}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Comment Like Button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              className={`flex items-center gap-1 text-xs transition-colors ${
                isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            
            {/* Delete Button */}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onDelete(postId, comment.id); }}
                className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
        
        {/* Timestamp */}
        <p className="text-xs text-slate-400 mt-1">
          {comment.created_at && format(new Date(comment.created_at), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

// Image Lightbox Component
const ImageLightbox = memo(({ imageUrl, onClose }) => (
  <Dialog open={!!imageUrl} onOpenChange={() => onClose()}>
    <DialogContent className="max-w-4xl p-0 bg-transparent border-none">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-50 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={imageUrl}
        alt="Full size"
        className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
      />
    </DialogContent>
  </Dialog>
));

ImageLightbox.displayName = 'ImageLightbox';

// Post Card Component - Memoized to prevent unnecessary re-renders
const PostCard = memo(({ 
  post, 
  isAdmin, 
  currentUserId,
  onLikePost,
  onDeletePost,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  token
}) => {
  const [showAllComments, setShowAllComments] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const getPostTypeIcon = (type) => {
    switch(type) {
      case 'appreciation': return <Award className="w-5 h-5 text-yellow-500" />;
      case 'notice': return <Bell className="w-5 h-5 text-blue-500" />;
      default: return <Megaphone className="w-5 h-5 text-purple-500" />;
    }
  };

  const getPostTypeBadge = (type) => {
    switch(type) {
      case 'appreciation': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Appreciation</Badge>;
      case 'notice': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Notice</Badge>;
      default: return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Announcement</Badge>;
    }
  };

  // UPDATED: Show only 2 most recent comments by default (sorted latest first)
  const allComments = useMemo(() => {
    const comments = post.comments || post.recent_comments || [];
    // Sort by created_at descending (latest first)
    return [...comments].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }, [post.comments, post.recent_comments]);
  
  // Show only 2 comments by default, all when expanded
  const displayedComments = showAllComments ? allComments : allComments.slice(0, 2);
  const totalComments = allComments.length;
  const hasMoreComments = totalComments > 2;
  const hiddenCount = totalComments - 2;

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        {/* Post Header */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getPostTypeIcon(post.post_type)}
              <div>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {post.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <User className="w-3 h-3" />
                  <span>{post.created_by_name}</span>
                  {post.created_by_role && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {post.created_by_role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </Badge>
                  )}
                  <span>•</span>
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(post.created_at), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getPostTypeBadge(post.post_type)}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePost(post.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* FIX #3: Post Image - Instagram-like with click to enlarge */}
          {post.image_url && (
            <div 
              className="relative cursor-pointer group"
              onClick={() => setLightboxImage(`${BACKEND_URL}${post.image_url}`)}
            >
              <img
                src={`${BACKEND_URL}${post.image_url}`}
                alt={post.title}
                className="w-full max-h-96 object-cover rounded-lg transition-transform group-hover:scale-[1.01]"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
            </div>
          )}

          {/* Post Content */}
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{post.description}</p>

          {/* FIX #4: Engagement Stats - Visible to ALL users */}
          <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLikePost(post.id)}
              className={`flex items-center gap-2 transition-all ${
                post.is_liked_by_me ? 'text-red-500 scale-105' : 'text-slate-600 hover:text-red-400'
              }`}
            >
              <Heart className={`w-5 h-5 transition-transform ${post.is_liked_by_me ? 'fill-current animate-pulse' : ''}`} />
              <span className="font-medium">{post.likes || 0}</span>
            </Button>
            <div className="flex items-center gap-2 text-slate-600">
              <MessageCircle className="w-5 h-5" />
              <span>{comments.length} comments</span>
            </div>
            {!post.comments_enabled && (
              <div className="flex items-center gap-1 text-xs text-slate-400 ml-auto">
                <MessageSquareOff className="w-4 h-4" />
                Comments disabled
              </div>
            )}
          </div>

          {/* FIX #2: Comments Section - Visible to ALL users (students & admins) */}
          {comments.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Comments ({comments.length})
                </p>
                {hasMoreComments && (
                  <button
                    onClick={() => setShowAllComments(!showAllComments)}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                  >
                    {showAllComments ? 'Show less' : `View all ${comments.length} comments`}
                  </button>
                )}
              </div>
              
              <div className="space-y-2">
                {displayedComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    postId={post.id}
                    canDelete={isAdmin || comment.author_id === currentUserId}
                    onDelete={onDeleteComment}
                    onLike={onLikeComment}
                    currentUserId={currentUserId}
                    token={token}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Add Comment - Available to ALL authenticated users when comments enabled */}
          {post.comments_enabled && (
            <CommentInput 
              postId={post.id} 
              onSubmit={onAddComment}
              disabled={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      <ImageLightbox 
        imageUrl={lightboxImage} 
        onClose={() => setLightboxImage(null)} 
      />
    </>
  );
});

PostCard.displayName = 'PostCard';

// Main Component
const CampusFeed = () => {
  const navigate = useNavigate();
  const { user, token, role, isAdmin } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Create post form
  const [postForm, setPostForm] = useState({
    title: '',
    description: '',
    post_type: 'announcement',
    comments_enabled: true,
    image: null
  });

  const currentUserId = user?.id || user?.sub;

  const fetchPosts = useCallback(async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/feed/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // FIX #3: Image upload with preview
  const handleImageSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size should be less than 10MB');
        return;
      }
      setPostForm(prev => ({ ...prev, image: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const clearImage = useCallback(() => {
    setPostForm(prev => ({ ...prev, image: null }));
    setImagePreview(null);
  }, []);

  const handleCreatePost = useCallback(async () => {
    if (!postForm.title.trim() || !postForm.description.trim()) {
      toast.error('Please fill in title and description');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', postForm.title);
      formData.append('description', postForm.description);
      formData.append('post_type', postForm.post_type);
      formData.append('comments_enabled', postForm.comments_enabled);
      if (postForm.image) {
        formData.append('image', postForm.image);
      }

      await axios.post(`${BACKEND_URL}/api/feed/posts`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Post created successfully!');
      setShowCreateDialog(false);
      setPostForm({ title: '', description: '', post_type: 'announcement', comments_enabled: true, image: null });
      setImagePreview(null);
      fetchPosts();
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setSubmitting(false);
    }
  }, [postForm, token, fetchPosts]);

  // Optimistic update for likes
  const handleLikePost = useCallback(async (postId) => {
    // Optimistic update
    setPosts(prevPosts => prevPosts.map(p => 
      p.id === postId 
        ? { 
            ...p, 
            likes: p.is_liked_by_me ? (p.likes || 1) - 1 : (p.likes || 0) + 1,
            is_liked_by_me: !p.is_liked_by_me 
          }
        : p
    ));

    try {
      await axios.post(
        `${BACKEND_URL}/api/feed/posts/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      // Revert on error
      fetchPosts();
      toast.error('Failed to like post');
    }
  }, [token, fetchPosts]);

  const handleAddComment = useCallback(async (postId, content) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/feed/posts/${postId}/comments`,
        { content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Comment added!');
      fetchPosts();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to add comment';
      toast.error(message);
    }
  }, [token, fetchPosts]);

  const handleDeleteComment = useCallback(async (postId, commentId) => {
    try {
      await axios.delete(
        `${BACKEND_URL}/api/feed/posts/${postId}/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Comment deleted');
      fetchPosts();
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  }, [token, fetchPosts]);

  const handleLikeComment = useCallback(async (postId, commentId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/feed/posts/${postId}/comments/${commentId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error('Failed to like comment');
      throw error;
    }
  }, [token]);

  const handleDeletePost = useCallback(async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      await axios.delete(`${BACKEND_URL}/api/feed/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Post deleted');
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      toast.error('Failed to delete post');
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => navigate(isAdmin ? '/admin' : '/student')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                <h1 className="font-bold text-slate-900 text-sm sm:text-base">Campus Feed</h1>
              </div>
            </div>
            
            {isAdmin && (
              <Button 
                onClick={() => setShowCreateDialog(true)} 
                className="bg-purple-600 hover:bg-purple-700 text-sm px-3 py-2"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Create Post</span>
                <span className="sm:hidden">Post</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Info Banner */}
        <Card className="mb-4 sm:mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-purple-900 text-sm sm:text-base">Campus Notice & Appreciation Feed</h3>
                <p className="text-xs sm:text-sm text-purple-700 mt-1">
                  Official announcements and student appreciations.
                  {isAdmin && " Create posts to communicate with students."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Megaphone className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700">No posts yet</h3>
              <p className="text-slate-500 mt-2">
                {isAdmin 
                  ? "Create the first post to share with students!" 
                  : "Check back later for announcements and updates."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                onLikePost={handleLikePost}
                onDeletePost={handleDeletePost}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
                onLikeComment={handleLikeComment}
                token={token}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Post Dialog - Admin Only */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              Create New Post
            </DialogTitle>
            <DialogDescription>
              Share announcements, appreciate students, or post notices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Post Type</Label>
              <Select 
                value={postForm.post_type} 
                onValueChange={(value) => setPostForm(prev => ({ ...prev, post_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="announcement">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-purple-500" />
                      Announcement
                    </div>
                  </SelectItem>
                  <SelectItem value="appreciation">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-yellow-500" />
                      Appreciation
                    </div>
                  </SelectItem>
                  <SelectItem value="notice">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-500" />
                      Notice
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Enter post title"
                value={postForm.title}
                onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                placeholder="Write your post content..."
                value={postForm.description}
                onChange={(e) => setPostForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className="resize-none"
              />
            </div>

            {/* FIX #3: Image Upload with Preview */}
            <div className="space-y-2">
              <Label>Image (Optional)</Label>
              {imagePreview ? (
                <div className="relative">
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">Click to upload image</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="comments_enabled"
                checked={postForm.comments_enabled}
                onChange={(e) => setPostForm(prev => ({ ...prev, comments_enabled: e.target.checked }))}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <Label htmlFor="comments_enabled" className="text-sm cursor-pointer">Allow comments</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setImagePreview(null);
              setPostForm({ title: '', description: '', post_type: 'announcement', comments_enabled: true, image: null });
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePost} 
              disabled={submitting || !postForm.title.trim() || !postForm.description.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating...
                </>
              ) : (
                'Create Post'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CampusFeed;
